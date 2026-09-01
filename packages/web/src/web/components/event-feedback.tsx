import { Check, HelpCircle, X } from "lucide-react";
import { clientId } from "../lib/alpha";
import { useMyFeedback, useSendFeedback } from "../queries/signals";
import { cn } from "../lib/utils";

type Answer = boolean | null;

function Pill({
  active,
  onClick,
  children,
  tone = "neutral",
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "yes" | "no" | "neutral";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50",
        active && tone === "yes" && "border-basil bg-basil-soft text-basil",
        active && tone === "no" && "border-tomato bg-tomato-soft text-tomato",
        active && tone === "neutral" && "border-ink bg-ink text-white",
        !active && "border-line text-ink-soft hover:border-ink/40 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Two questions, one tap each. The first turns an AI guess into ground truth.
 * The second is the only metric that decides whether this app deserves to exist:
 * did it tell you something you had no other way of knowing?
 */
export function EventFeedback({ eventId, aiSaidFood }: { eventId: number; aiSaidFood: boolean }) {
  const mine = useMyFeedback();
  const send = useSendFeedback();

  const row = mine.data?.find((m) => m.eventId === eventId);
  const went: Answer = row?.wentThere ?? null;
  const hadFood: Answer = row?.hadFood ?? null;
  const knew: Answer = row?.knewAlready ?? null;

  const answer = (patch: {
    wentThere?: boolean;
    hadFood?: boolean;
    knewAlready?: boolean;
  }) => {
    send.mutate(
      {
        eventId,
        clientId: clientId(),
        wentThere: patch.wentThere ?? null,
        hadFood: patch.hadFood ?? null,
        knewAlready: patch.knewAlready ?? null,
      },
      { onSuccess: () => void mine.refetch() },
    );
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-line bg-bg/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">
          Did you go?
        </span>
        <Pill active={went === true} tone="yes" onClick={() => answer({ wentThere: true })}>
          <Check className="size-3" /> Yes
        </Pill>
        <Pill active={went === false} tone="no" onClick={() => answer({ wentThere: false })}>
          <X className="size-3" /> No
        </Pill>

        {went === true && (
          <>
            <span className="ml-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">
              Was there food?
            </span>
            <Pill active={hadFood === true} tone="yes" onClick={() => answer({ hadFood: true })}>
              <Check className="size-3" /> Yes
            </Pill>
            <Pill active={hadFood === false} tone="no" onClick={() => answer({ hadFood: false })}>
              <X className="size-3" /> No
            </Pill>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">
          <HelpCircle className="size-3" />
          Would you have known without this?
        </span>
        <Pill active={knew === false} tone="yes" onClick={() => answer({ knewAlready: false })}>
          No — found it here
        </Pill>
        <Pill active={knew === true} onClick={() => answer({ knewAlready: true })}>
          Yes, already knew
        </Pill>
      </div>

      {hadFood === false && aiSaidFood && (
        <p className="text-[11px] font-semibold text-tomato">
          Logged as a false positive — the model said food, you said no. That correction is worth
          more than the guess.
        </p>
      )}
    </div>
  );
}
