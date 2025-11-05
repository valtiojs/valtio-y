import type { Route } from "./+types/home";
import { CollaborativeTextBox } from "../components/CollaborativeTextBox";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Y-PartyServer Todo - Collaborative Text" },
    {
      name: "description",
      content: "Real-time collaborative text editing with Yjs and PartyServer",
    },
  ];
}

export default function Home() {
  return <CollaborativeTextBox />;
}
