import { Construction } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

interface ComingSoonPageProps {
  title: string;
  description?: string;
}

/** Placeholder for college portal sections under active development. */
export default function ComingSoonPage({
  title,
  description = "This module is part of the Campus Portal redesign and will be available soon.",
}: ComingSoonPageProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Construction className="h-7 w-7 text-admin-accent" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-gray-500">
            Use <strong>Dashboard</strong> and <strong>Students</strong> in the sidebar for now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
