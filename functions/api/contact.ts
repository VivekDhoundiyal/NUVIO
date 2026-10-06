// Cloudflare Pages Function: /api/contact
// Serverless form endpoint running on Cloudflare's free edge tier.
// Keeps destination email and server-side processing private from client bundles.

interface Env {
  CONTACT_EMAIL?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as {
      name?: string;
      email?: string;
      reason?: string;
      message?: string;
      honeypot?: string;
      timestamp?: number;
    };

    // 1. Basic spam & bot checks
    if (data.honeypot && data.honeypot.trim().length > 0) {
      return new Response(JSON.stringify({ error: 'Spam detected' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (data.timestamp && Date.now() - data.timestamp < 1000) {
      return new Response(JSON.stringify({ error: 'Form submitted too rapidly' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate required inputs
    const name = (data.name || '').trim();
    const email = (data.email || '').trim();
    const message = (data.message || '').trim();
    const _reason = (data.reason || 'General question').trim();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Please provide your name, email, and message.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Server-side processing
    // In production on Cloudflare Pages, environment variables or Cloudflare Email Routing
    // can forward this to the private destination email.
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you! Your message has been received.',
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Could not process submission.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
