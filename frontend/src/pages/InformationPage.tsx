import { Link } from "react-router-dom";
import { Brand } from "../components/ui";
const information = {
  privacy: { title: "Privacy", copy: "ERCS sends submitted records to your team's configured API. Contact your organization for its data retention and access policies. No password or database credential should be shared through support messages." },
  security: { title: "Security", copy: "Use credentials issued by your organization and keep activation links private. Account access requires the server's authentication service. Report suspected access problems to your ERCS administrator." },
  support: { title: "Support", copy: "Contact your ERCS administrator for account activation, password recovery, and access requests. Sign-in and several coordination services are awaiting backend integration. A failed request does not mean your changes were saved." },
};
export function InformationPage({ kind }: { kind: keyof typeof information }) {
  const content = information[kind];
  return <main className="public-page"><div className="page-container"><Brand /><section className="panel panel-padding"><h1>{content.title}</h1><p>{content.copy}</p><Link className="button" to="/login">Return to sign in</Link><Link className="button secondary" to="/">Home</Link></section></div></main>;
}
