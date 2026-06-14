import { headers } from "next/headers";
import Settings from "./Settings";

export default async function SettingsPage() {
  const host = process.env.NODE_ENV === "production" ? "app.flexile.com" : (await headers()).get("Host");
  const clientId = process.env.GITHUB_CLIENT_ID ?? "";
  const redirectUrl = `https://${host}/oauth_redirect`;
  const githubOauthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=repo+admin:org_hook`;
  return <Settings githubOauthUrl={githubOauthUrl} />;
}
