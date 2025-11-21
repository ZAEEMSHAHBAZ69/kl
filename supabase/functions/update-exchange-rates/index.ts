import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
  time_last_update_unix: number;
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

    console.log("Fetching exchange rates from API...");

    const apiUrl = "https://open.er-api.com/v6/latest/USD";
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data: ExchangeRateResponse = await response.json();

    if (data.result !== "success") {
      throw new Error("Failed to fetch exchange rates");
    }

    console.log(`Fetched ${Object.keys(data.conversion_rates).length} exchange rates`);

    const rateDate = new Date(data.time_last_update_unix * 1000).toISOString().split('T')[0];
    const ratesToInsert = [];

    for (const [currencyCode, rate] of Object.entries(data.conversion_rates)) {
      // API returns: 1 USD = X units of foreign currency
      // We need: 1 unit of foreign currency = X USD
      // So we store the inverse: 1 / rate
      const usdRate = currencyCode === 'USD' ? 1.0 : 1.0 / rate;

      ratesToInsert.push({
        currency_code: currencyCode,
        usd_rate: usdRate,
        rate_date: rateDate,
        source: 'open.er-api.com',
      });
    }

    console.log(`Upserting ${ratesToInsert.length} exchange rates for ${rateDate}...`);

    const { error: upsertError } = await supabase
      .from('exchange_rates')
      .upsert(ratesToInsert, {
        onConflict: 'currency_code,rate_date',
      });

    if (upsertError) {
      throw upsertError;
    }

    console.log(`Successfully updated exchange rates for ${rateDate}`);

    const { data: verifyData, error: verifyError } = await supabase
      .from('exchange_rates')
      .select('currency_code, usd_rate')
      .eq('rate_date', rateDate)
      .in('currency_code', ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']);

    if (verifyError) {
      console.error('Warning: Could not verify rates:', verifyError);
    } else {
      console.log('Sample rates:', verifyData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Exchange rates updated successfully",
        rateDate,
        ratesUpdated: ratesToInsert.length,
        sampleRates: verifyData || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error updating exchange rates:", error);
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