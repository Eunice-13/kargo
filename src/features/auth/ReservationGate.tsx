import { useEffect, useRef, useState } from "react"

import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

type ReservationGateStep = "question" | "choose"

export default function ReservationGate({
  batchTitle,
  sellerName,
  onLogin,
  onSignUp,
  onDismiss,
}: {
  batchTitle?: string
  sellerName?: string
  onLogin: () => void
  onSignUp: () => void
  onDismiss: () => void
}) {
  const [step, setStep] = useState<ReservationGateStep>("question")
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (step === "choose") stepHeadingRef.current?.focus()
  }, [step])

  return (
    <Modal title="Do you have a reservation?" onClose={onDismiss} width={440}>
      <div className="space-y-5">
        {step === "question" ? (
          <>
            <div className="space-y-3 text-sm leading-6 text-gray-600">
              <p>
                A reservation holds an item for you until its payment deadline.
                This batch was shared with you, and you need an account to view
                it or reserve items.
              </p>
              {batchTitle && (
                <p>
                  Shared batch:{" "}
                  <strong className="text-gray-900">{batchTitle}</strong>
                  {sellerName ? ` by ${sellerName}` : ""}
                </p>
              )}
              <p>
                The shared batch will open next after you log in or create an
                account.
              </p>
            </div>

            <div className="grid gap-3">
              <PrimaryBtn
                onClick={() => setStep("choose")}
                style={{ width: "100%" }}
              >
                Yes, I have a reservation
              </PrimaryBtn>
              <SecondaryBtn onClick={onSignUp} style={{ width: "100%" }}>
                No, not yet
              </SecondaryBtn>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 text-sm leading-6 text-gray-600">
              <h4
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-base font-semibold text-gray-900 outline-none"
              >
                How would you like to continue?
              </h4>
              <p>
                Log in to your existing account or create one. Your shared batch
                will open when you are done.
              </p>
            </div>

            <div className="grid gap-3">
              <PrimaryBtn onClick={onLogin} style={{ width: "100%" }}>
                Log in
              </PrimaryBtn>
              <SecondaryBtn onClick={onSignUp} style={{ width: "100%" }}>
                Create account
              </SecondaryBtn>
              <SecondaryBtn
                onClick={() => setStep("question")}
                style={{ width: "100%" }}
              >
                Back to reservation question
              </SecondaryBtn>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
