import { supabase, Invitation, AuditLog, UserRole } from './supabase';
import {
  InvitationError,
  InvitationErrorType,
  handleInvitationError,
  withRetry,
  validateEmail,
  isValidToken,
  getUserAgent
} from './errorHandling';

export const inviteUserDirectly = async (
  email: string,
  role: UserRole,
  invitedBy: string,
  metadata?: {
    full_name?: string;
    company_name?: string;
    partner_id?: string;
    inviter_name?: string;
  }
): Promise<{ success: boolean; error?: string; userId?: string }> => {
  try {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    const { data: session } = await supabase.auth.getSession();

    if (!session?.session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        email,
        name: metadata?.full_name || email.split('@')[0],
        role,
        invited_by: invitedBy,
        company_name: metadata?.company_name,
        partner_id: metadata?.partner_id,
        metadata: {
          full_name: metadata?.full_name || email.split('@')[0],
          company_name: metadata?.company_name,
          inviter_name: metadata?.inviter_name,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to send invitation:', data);
      return { success: false, error: data.error || 'Failed to send invitation' };
    }

    console.log('Invitation sent successfully to:', email);
    return { success: true, userId: data.user_id };
  } catch (error: any) {
    console.error('Failed to invite user:', error);
    return { success: false, error: error.message || 'Failed to send invitation' };
  }
};

// Generate cryptographically secure token
export const generateSecureToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Create audit log entry (normalize to snake_case columns)
export const createAuditLog = async (
  logData: Omit<AuditLog, 'id' | 'created_at'>
): Promise<void> => {
  const payload = {
    user_id: (logData as any).user_id ?? (logData as any).userId ?? null,
    action: logData.action,
    entity_type: (logData as any).resource_type ?? (logData as any).entity_type ?? 'unknown',
    entity_id: (logData as any).resource_id ?? (logData as any).entity_id ?? (logData as any).invitation_id ?? (logData as any).invitationId ?? 'unknown',
    details: (logData as any).details ?? {},
    ip_address: (logData as any).ip_address ?? null,
    user_agent: (logData as any).user_agent ?? (logData as any).userAgent ?? null
  };

  const { error } = await supabase.from('audit_logs').insert([payload]);

  if (error) {
    console.error('Audit log creation error:', error);
  }
};

// Generate magic link URL
export const generateMagicLink = (token: string, baseUrl?: string): string => {
  const base = baseUrl || window.location.origin;
  return `${base}/invite/${token}`;
};

// Send invitation email using Supabase OTP (magic link)
export const sendInvitationEmail = async (
  email: string,
  role: UserRole,
  invitedBy: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string; userId?: string }> => {
  try {
    const token = generateSecureToken();
    const inviteUrl = `${window.location.origin}/invite/${token}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: inviteUrl,
        data: {
          invitation_token: token,
          role,
          invited_by: invitedBy,
          full_name: metadata?.full_name || email.split('@')[0],
          company_name: metadata?.company_name,
          partner_id: metadata?.partner_id,
        }
      }
    });

    if (error) {
      console.error('Invitation email error:', error);
      return { success: false, error: error.message };
    }

    console.log('Invitation sent successfully to:', email);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: 'Failed to send invitation email' };
  }
};

// Enhanced createInvitation with magic link generation and email sending
export const createInvitation = async (
  email: string,
  role: UserRole,
  invitedBy: string,
  partnerIdOrMetadata?: string | Record<string, any>,
  inviterName?: string
): Promise<{ success: boolean; error?: string; invitationId?: string; magicLink?: string }> => {
  try {
    if (!validateEmail(email)) {
      throw new InvitationError(
        'Invalid email format',
        InvitationErrorType.VALIDATION_ERROR,
        { email },
        'Please enter a valid email address'
      );
    }

    const result = await withRetry(async () => {
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      let partnerId: string | null = null;
      let metadata: Record<string, any> = {};

      if (typeof partnerIdOrMetadata === 'string') {
        partnerId = partnerIdOrMetadata;
      } else if (partnerIdOrMetadata && typeof partnerIdOrMetadata === 'object') {
        metadata = partnerIdOrMetadata;
        partnerId = metadata.partner_id || null;
      }

      // Create invitation record
      const { data: invitation, error: invitationError } = await supabase
        .from('invitations')
        .insert({
          email,
          role,
          token,
          partner_id: partnerId,
          invited_by: invitedBy,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
          metadata
        })
        .select('id,expires_at,token')
        .single();

      if (invitationError) {
        throw new InvitationError(
          invitationError.message,
          InvitationErrorType.DATABASE_ERROR,
          { email, role, error: invitationError.message },
          'Failed to create invitation. Please try again.'
        );
      }

      // Send invitation email using Supabase Auth
      const emailResult = await sendInvitationEmail(
        email,
        role,
        invitedBy,
        metadata
      );

      if (!emailResult.success) {
        throw new InvitationError(
          emailResult.error || 'Failed to send invitation',
          InvitationErrorType.EMAIL_SEND_FAILED,
          { email, role },
          'Failed to send invitation email. Please try again.'
        );
      }
      // TODO: Configure Supabase Auth SMTP settings for email functionality
      console.log(`Invitation created for ${email} with token: ${token}`);
      console.log(`Manual invitation URL: ${window.location.origin}/invite/${token}`);
      
      // Temporarily comment out email sending to allow invitation creation
      /*
      const redirectUrl = `${window.location.origin}/invite/${token}`;
      const { error: emailError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            invitation_token: token,
            role,
            invited_by: invitedBy,
            invitation_id: invitation.id
          }
        }
      });

      if (emailError) {
        await supabase
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);

        throw new InvitationError(
          emailError.message,
          InvitationErrorType.EMAIL_SEND_FAILED,
          { email, role, error: emailError.message },
          'Failed to send invitation email. Please check the email address and try again.'
        );
      }
      */

      return invitation;
    }, 3, 1000);

    await createAuditLog({
      user_id: invitedBy,
      invitation_id: result.id,
      action: 'invitation_created',
      resource_type: 'invitation',
      resource_id: result.id,
      details: { email, role, expires_at: result.expires_at },
      ip_address: null,
      user_agent: getUserAgent(),
      success: true,
      error_message: null
    } as any);

    // Generate magic link for the created invitation
    const magicLink = generateMagicLink(result.token);

    return { success: true, invitationId: result.id, magicLink };

  } catch (error) {
    const invitationError = await handleInvitationError(error, {
      action: 'invitation_create',
      userId: invitedBy,
      email,
      userAgent: getUserAgent()
    });

    return { success: false, error: invitationError.userMessage };
  }
};

// Enhanced validateInvitationToken with better error handling
export const validateInvitationToken = async (
  token: string
): Promise<{ valid: boolean; invitation?: Invitation; error?: string }> => {
  try {
    if (!isValidToken(token)) {
      throw new InvitationError(
        'Invalid token format',
        InvitationErrorType.TOKEN_INVALID,
        { tokenLength: token.length },
        'This invitation link is invalid or has been tampered with.'
      );
    }

    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      throw new InvitationError(
        error?.message || 'Token not found',
        InvitationErrorType.TOKEN_INVALID,
        { error: error?.message },
        'This invitation link is invalid or has been tampered with.'
      );
    }

    if (invitation.status === 'accepted') {
      throw new InvitationError(
        'Token already used',
        InvitationErrorType.TOKEN_ALREADY_USED,
        { email: invitation.email, acceptedAt: invitation.accepted_at },
        'This invitation link has already been used to create an account.'
      );
    }

    if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
      if (invitation.status !== 'expired') {
        await supabase
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);
      }

      throw new InvitationError(
        'Token expired',
        InvitationErrorType.TOKEN_EXPIRED,
        { email: invitation.email, expiresAt: invitation.expires_at },
        'This invitation link has expired. Please request a new invitation.'
      );
    }

    return { valid: true, invitation };

  } catch (error) {
    const invitationError = await handleInvitationError(error, {
      action: 'invitation_validate',
      userAgent: getUserAgent()
    });

    return { valid: false, error: invitationError.userMessage };
  }
};

// Enhanced acceptInvitation with better error handling
export const acceptInvitation = async (
  token: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: any }> => {
  try {
    const validation = await validateInvitationToken(token);
    if (!validation.valid || !validation.invitation) {
      return { success: false, error: validation.error };
    }

    const invitation = validation.invitation;

    const result = await withRetry(async () => {
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: invitation.metadata?.full_name || '',
            company_name: invitation.metadata?.company_name || '',
            role: invitation.role,
            invited_by: invitation.invited_by,
            partner_id: invitation.partner_id,
            invitation_id: invitation.id
          }
        }
      });

      if (authError) {
        throw new InvitationError(
          authError.message,
          InvitationErrorType.AUTH_CREATION_FAILED,
          { email: invitation.email, error: authError.message },
          'Failed to create your account. Please try again or contact support.'
        );
      }

      // Validate role before signup
      const validatedRole = invitation.role;
      if (!['admin', 'partner', 'super_admin'].includes(validatedRole)) {
        throw new InvitationError(
          `Invalid role: ${validatedRole}`,
          InvitationErrorType.VALIDATION_ERROR,
          { email: invitation.email, role: validatedRole },
          'Invalid user role detected. Please contact support.'
        );
      }

      console.log(`User signed up with role: ${validatedRole} for email: ${invitation.email}`);
      console.log(`Invitation metadata - invited_by: ${invitation.invited_by}, partner_id: ${invitation.partner_id}`);

      // Wait for trigger to create app_users record with retry logic
      // The auto_add_to_app_users trigger handles the insertion
      let verifyUser = null;
      let verifyError = null;
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries && !verifyUser) {
        await new Promise(resolve => setTimeout(resolve, retries === 0 ? 500 : 1000));

        const result = await supabase
          .from('app_users')
          .select('id, role, invited_by, partner_id')
          .eq('id', authUser.user?.id)
          .maybeSingle();

        verifyUser = result.data;
        verifyError = result.error;

        if (verifyUser) {
          console.log(`User profile verified on attempt ${retries + 1}`);
          break;
        }

        retries++;
        console.log(`Waiting for user profile... attempt ${retries}/${maxRetries}`);
      }

      if (verifyError || !verifyUser) {
        throw new InvitationError(
          verifyError?.message || 'User profile not created by trigger',
          InvitationErrorType.DATABASE_ERROR,
          { email: invitation.email, error: verifyError?.message, retriesAttempted: retries },
          'Your account was created but the profile setup failed. Please contact support with this error.'
        );
      }

      if (verifyUser.role !== validatedRole) {
        console.error(`CRITICAL: User role mismatch! Expected: ${validatedRole}, Got: ${verifyUser.role}`);
        throw new InvitationError(
          'Role assignment failed',
          InvitationErrorType.DATABASE_ERROR,
          { email: invitation.email, expected: validatedRole, actual: verifyUser.role },
          'User role was not assigned correctly. Please contact support.'
        );
      }

      if (invitation.invited_by && verifyUser.invited_by !== invitation.invited_by) {
        console.warn(`WARNING: invited_by mismatch! Expected: ${invitation.invited_by}, Got: ${verifyUser.invited_by}`);
      }

      console.log(`User created successfully with correct role: ${verifyUser.role}, invited_by: ${verifyUser.invited_by}`);

      return authUser;
    }, 3, 1000);

    await supabase
      .from('invitations')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    await createAuditLog({
      user_id: result.user?.id || undefined,
      invitationId: invitation.id,
      action: 'invitation_accepted',
      resource_type: 'invitation',
      resource_id: invitation.id,
      details: { email: invitation.email, role: invitation.role },
      ip_address: undefined,
      userAgent: getUserAgent(),
      success: true,
      error_message: undefined
    });

    return { success: true, user: result.user };

  } catch (error) {
    const invitationError = await handleInvitationError(error, {
      action: 'invitation_accept',
      email: token,
      userAgent: getUserAgent()
    });

    return { success: false, error: invitationError.userMessage };
  }
};