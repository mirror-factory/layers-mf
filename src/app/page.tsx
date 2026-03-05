import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>layers-mf</CardTitle>
          <CardDescription>Your Next.js + shadcn/ui app is ready.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button>Get Started</Button>
          <Button variant="outline">Learn More</Button>
        </CardContent>
      </Card>
    </main>
  );
}
