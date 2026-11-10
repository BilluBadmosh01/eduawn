import { supabase } from "@/integrations/supabase/client";

const GILLY_IDENTITY_URL =
  "https://nascar-affairs-income-sic.trycloudflare.com/webhook/gilly-identity";

export async function identifyGillyStudent(): Promise<string> {
  // Get the current Supabase session
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error("Could not retrieve your login session.");
  }

  const session = data.session;

  if (!session) {
    throw new Error("Please log in before opening Gilly AI.");
  }

  // Send the access token to our identity gateway
  const response = await fetch(GILLY_IDENTITY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access_token: session.access_token,
    }),
  });

  if (!response.ok) {
    const errorText = await reponse.text();
    throw new Error(
      'Identity gateway error: ${response.status} - ${errotText}'
    );
  }

  const result: { student_id?: string } = await response.json();

  if (!result.student_id) {
    throw new Error("Gilly received an invalid student identity.");
  }

  return result.student_id;
}
