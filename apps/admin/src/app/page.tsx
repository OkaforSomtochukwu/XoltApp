import { Badge, Button, Card, Input } from "@/components/ui";

export default function Home() {
  return (
    <main className="stack" style={{ maxWidth: 620, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1>Xolt Admin</h1>
      <p>Internal admin dashboard, styled with the Modernist design system.</p>
      <hr className="hr" />

      <div className="row">
        <Card>
          <Card.Kicker>Design system</Card.Kicker>
          <Card.Title>@xolt/ui-tokens is wired up</Card.Title>
          <Card.Body>Button, Card, Badge and Input all read from the shared tokens.</Card.Body>
          <Badge variant="accent">Modernist</Badge>
        </Card>
      </div>

      <div className="row">
        <Button variant="primary">Continue</Button>
        <Button variant="secondary">Preview</Button>
        <Button variant="ghost">Learn more</Button>
      </div>

      <Input label="Project name" defaultValue="Untitled project" />
    </main>
  );
}
