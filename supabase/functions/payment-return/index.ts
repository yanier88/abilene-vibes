Deno.serve(() => {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Abilene Vibes Payment</title>
    <style>
      :root { color-scheme: dark; font-family: Arial, sans-serif; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        color: #fff;
        background:
          radial-gradient(circle at 20% 20%, rgba(255, 0, 204, 0.28), transparent 34%),
          radial-gradient(circle at 80% 22%, rgba(0, 212, 255, 0.25), transparent 32%),
          #050008;
      }
      main {
        width: min(100%, 520px);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 24px;
        padding: 28px;
        background: rgba(8, 10, 31, 0.82);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
      }
      p { color: rgba(255, 255, 255, 0.76); line-height: 1.55; }
      .eyebrow { color: #28e7ff; font-size: 0.82rem; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; }
      h1 { margin: 8px 0 10px; font-size: clamp(2.3rem, 12vw, 4rem); line-height: 0.95; }
      a {
        display: inline-flex;
        min-height: 48px;
        align-items: center;
        justify-content: center;
        margin-top: 10px;
        border-radius: 999px;
        padding: 0 20px;
        color: #fff;
        font-weight: 900;
        text-decoration: none;
        background: linear-gradient(135deg, #ff00cc, #00d4ff);
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Abilene Vibes</p>
      <h1 id="title">Payment received</h1>
      <p id="copy">Thanks. Your listing payment was received and your business is waiting for admin review.</p>
      <a href="mailto:abilenevibes@gmail.com">Contact Abilene Vibes</a>
    </main>
    <script>
      const checkout = new URLSearchParams((location.hash.split("?")[1] || "")).get("checkout");
      if (checkout === "cancelled") {
        document.getElementById("title").textContent = "Checkout cancelled";
        document.getElementById("copy").textContent = "Your request was saved, but the paid placement is not active yet.";
      }
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
