const appUrl = "https://yanier88.github.io/abilene-vibes/";

Deno.serve((request) => {
  const url = new URL(request.url);
  const checkout = url.searchParams.get("checkout");
  const target =
    checkout === "cancelled" ? `${appUrl}#promote?checkout=cancelled` : `${appUrl}#directory?checkout=success`;

  return Response.redirect(target, 303);
});
