import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConversionRequest {
  amounts: Array<{
    amount: number;
    currency: string;
  }>;
  targetCurrency?: string;
}

interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: ConversionRequest = await req.json();
    const targetCurrency = requestData.targetCurrency || "USD";

    if (!requestData.amounts || !Array.isArray(requestData.amounts)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request: amounts array is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all unique currencies from the request
    const currencies = new Set(requestData.amounts.map(item => item.currency));
    currencies.add(targetCurrency);

    // Fetch exchange rates for all currencies
    const { data: rates, error: ratesError } = await supabase
      .from("exchange_rates")
      .select("currency_code, usd_rate")
      .in("currency_code", Array.from(currencies))
      .order("rate_date", { ascending: false });

    if (ratesError) {
      throw ratesError;
    }

    // Build a map of currency -> latest rate
    const rateMap = new Map<string, number>();
    const seenCurrencies = new Set<string>();

    if (rates) {
      for (const rate of rates) {
        if (!seenCurrencies.has(rate.currency_code)) {
          // Parse the usd_rate as it comes as a string from Postgres decimal type
          const usdRate = typeof rate.usd_rate === 'string' ? parseFloat(rate.usd_rate) : rate.usd_rate;
          rateMap.set(rate.currency_code, usdRate);
          seenCurrencies.add(rate.currency_code);
          console.log(`Loaded rate for ${rate.currency_code}: ${usdRate}`);
        }
      }
    }

    // USD always has rate 1.0
    if (!rateMap.has("USD")) {
      rateMap.set("USD", 1.0);
    }

    console.log('Rate map:', Object.fromEntries(rateMap));

    // Convert each amount
    const results: ConversionResult[] = requestData.amounts.map(item => {
      const fromRate = rateMap.get(item.currency) || 1.0;
      const toRate = rateMap.get(targetCurrency) || 1.0;
      console.log(`Converting ${item.amount} ${item.currency} to ${targetCurrency}: fromRate=${fromRate}, toRate=${toRate}`);

      // Convert: amount in source currency -> USD -> target currency
      const amountInUSD = item.amount * fromRate;
      const convertedAmount = amountInUSD / toRate;

      return {
        originalAmount: item.amount,
        originalCurrency: item.currency,
        convertedAmount,
        targetCurrency,
        exchangeRate: fromRate / toRate,
      };
    });

    // Calculate total
    const total = results.reduce((sum, result) => sum + result.convertedAmount, 0);

    return new Response(
      JSON.stringify({
        success: true,
        conversions: results,
        total,
        targetCurrency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error converting currency:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});