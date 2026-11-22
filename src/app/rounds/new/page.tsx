"use client";

import RoundForm from "@/components/RoundForm";
import { PageTitle } from "@/components/Editing";

export default function NewRoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageTitle>Add a round</PageTitle>
      <RoundForm />
    </main>
  );
}
