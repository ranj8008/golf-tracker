"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RoundForm from "@/components/RoundForm";
import { dangerClass, PageTitle, Problem } from "@/components/Editing";
import { deleteRound, loadRound, problem, type Round } from "@/lib/data";

export default function EditRoundPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [round, setRound] = useState<Round | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [sure, setSure] = useState(false);

  useEffect(() => {
    loadRound(id)
      .then(setRound)
      .catch((e) => setError(problem(e)));
  }, [id]);

  const remove = async () => {
    if (!sure) return setSure(true);
    try {
      await deleteRound(id);
      router.push("/");
    } catch (e) {
      setError(problem(e));
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageTitle
        action={
          <Link
            href={`/rounds/${id}`}
            className="flex min-h-11 items-center px-2 text-sm font-medium text-accent"
          >
            Cancel
          </Link>
        }
      >
        Edit round
      </PageTitle>
      <Problem>{error}</Problem>
      {round === null && <p className="text-muted">That round wasn&apos;t found.</p>}
      {round && (
        <>
          <RoundForm round={round} />
          <div className="mt-6 text-center">
            <button type="button" onClick={remove} className={dangerClass}>
              {sure ? "Tap again to delete this round" : "Delete round"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
