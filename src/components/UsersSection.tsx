import { Users as UsersIcon, UserCog, Shield, Mail, Phone, MapPin, Building, Clock, Trash2, Plus, RefreshCw } from 'lucide-react';
import { User } from '../pages/ControlCenter';
import { Invitation, UserRole } from '../lib/supabase';

interface UsersSectionProps {
  users: User[];
  pendingInvitations: Invitation[];
  currentUserId?: string;
  currentUserRole?: UserRole;
  onAddUser: () => void;
  onDeleteUser: (user: User) => void;
  onDeleteInvitation: (invitation: Invitation) => void;
  onCanDeleteUser: (user: User) => boolean;
  onCanDeleteInvitation: () => boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export default function UsersSection({
  users,
  pendingInvitations,
  currentUserId,
  currentUserRole,
  onAddUser,
  onDeleteUser,
  onDeleteInvitation,
  onCanDeleteUser,
  onCanDeleteInvitation,
  onRefresh,
  isRefreshing = false
}: UsersSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Users ({users.length + pendingInvitations.length})</h2>
        <div className="flex space-x-3">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={onAddUser}
            className="flex items-center space-x-2 bg-[#48a77f] hover:bg-[#3d9166] text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>{currentUserRole === 'super_admin' ? 'Add User' : 'Add Partner'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.length === 0 && pendingInvitations.length === 0 ? (
          <div className="col-span-full bg-[#161616] rounded-lg p-12 border border-[#2C2C2C] text-center">
            <UsersIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {currentUserRole === 'super_admin' ? 'No users configured' : 'No partners configured'}
            </p>
            <button
              onClick={onAddUser}
              className="mt-4 text-[#48a77f] hover:text-[#3d9166] font-medium"
            >
              {currentUserRole === 'super_admin' ? 'Add your first user' : 'Add your first partner'}
            </button>
          </div>
        ) : (
          <>
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-[#161616] rounded-lg p-6 border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-yellow-500/20">
                    <Clock className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                      Pending
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${
                      invitation.role === 'admin'
                        ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                        : 'bg-green-500/20 text-green-500 border-green-500/30'
                    }`}>
                      {invitation.role === 'admin' ? 'Admin' : 'Partner'}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  {invitation.metadata?.full_name || invitation.email.split('@')[0]}
                </h3>
                <p className="text-gray-400 text-sm mb-3">{invitation.email}</p>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-300">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    <span>Invitation sent</span>
                  </div>
                  {invitation.metadata?.company_name && (
                    <div className="flex items-center text-sm text-gray-300">
                      <Building className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{invitation.metadata.company_name}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-300">
                    <Clock className="w-4 h-4 mr-2 text-gray-400" />
                    <span>Expires: {new Date(invitation.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                  Invited by {invitation.metadata?.inviter_name || 'Admin'} on {new Date(invitation.created_at || '').toLocaleDateString()}
                </div>

                {onCanDeleteInvitation() && (
                  <div className="mt-4 pt-4 border-t border-[#2C2C2C]">
                    <button
                      onClick={() => onDeleteInvitation(invitation)}
                      className="w-full flex items-center justify-center space-x-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 py-2 px-4 rounded-lg transition-colors border border-red-600/30"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Cancel Invitation</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {users.map((user) => {
              const isSuperAdmin = user.role === 'super_admin';
              const isAdmin = user.role === 'admin';
              const isPartner = user.role === 'partner';
              const isCurrentUser = user.id === currentUserId;
              const canDelete = onCanDeleteUser(user);
              const displayName = user.full_name || user.name || 'No Name';
              const displayEmail = user.email || user.contact_email || '';

              return (
                <div
                  key={user.id}
                  className={`bg-[#161616] rounded-lg p-6 border transition-colors ${
                    isSuperAdmin
                      ? 'border-yellow-500/30 hover:border-yellow-500/50'
                      : 'border-[#2C2C2C] hover:border-[#48a77f]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${
                      isSuperAdmin ? 'bg-yellow-500' : isAdmin ? 'bg-blue-500' : 'bg-[#48a77f]'
                    }`}>
                      {isSuperAdmin ? (
                        <Shield className="w-6 h-6 text-white" />
                      ) : isAdmin ? (
                        <UserCog className="w-6 h-6 text-white" />
                      ) : (
                        <UsersIcon className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          user.status === 'active'
                            ? 'bg-green-500 text-white'
                            : user.status === 'inactive'
                            ? 'bg-gray-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {user.status}
                      </span>
                      {isSuperAdmin && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500 text-black">
                          Super Admin
                        </span>
                      )}
                      {isAdmin && !isSuperAdmin && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500 text-white">
                          Admin
                        </span>
                      )}
                      {isPartner && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-[#48a77f] text-white">
                          Partner
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-500 text-white">
                          You
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{displayName}</h3>
                  {displayEmail && <p className="text-gray-400 text-sm mb-3">{displayEmail}</p>}
                  {user.company_name && <p className="text-gray-500 text-xs mb-3">{user.company_name}</p>}

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-300">
                      <Shield className="w-4 h-4 mr-2 text-gray-400" />
                      <span>
                        {isSuperAdmin ? 'Super Administrator' : isAdmin ? 'Administrator' : 'Partner User'}
                      </span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center text-sm text-gray-300">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.address && (
                      <div className="flex items-center text-sm text-gray-300">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="truncate">{user.address}</span>
                      </div>
                    )}
                    {user.last_login && (
                      <div className="text-xs text-gray-400">
                        Last login: {new Date(user.last_login).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                      Protected account - Cannot be modified or deleted
                    </div>
                  )}

                  {canDelete && (
                    <div className="mt-4 pt-4 border-t border-[#2C2C2C]">
                      <button
                        onClick={() => onDeleteUser(user)}
                        className="w-full flex items-center justify-center space-x-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 py-2 px-4 rounded-lg transition-colors border border-red-600/30"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete User</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
