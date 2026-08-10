"use client";

import { useActionState } from "react";

import {
  initialRegistrationState,
  submitRegistration,
} from "@/lib/class-actions";
import { CLASS_FACTS } from "@/lib/tuesday-class";

/**
 * The registration form — the second half of the worksheet.
 *
 * Built on `useActionState` with a real `<form action>` so it submits before
 * hydration; owners on bad phone connections are the whole audience. Inputs
 * are uncontrolled and re-seeded from the values the action hands back, so a
 * validation error never wipes what someone just typed.
 */

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel";
  wide?: boolean;
  defaultValue?: string;
  error?: string;
};

function Field({
  name,
  label,
  type = "text",
  required = false,
  autoComplete,
  inputMode,
  wide = false,
  defaultValue,
  error,
}: FieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className={wide ? "tc-field tc-field-wide" : "tc-field"}>
      <label className="tc-label" htmlFor={name}>
        {label}
        {required && (
          <span className="tc-req" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={error ? "tc-input tc-input-error" : "tc-input"}
      />
      {error && (
        <p className="tc-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function RegistrationForm({ nextClassLabel }: { nextClassLabel: string }) {
  const [state, formAction, pending] = useActionState(
    submitRegistration,
    initialRegistrationState,
  );

  const values = state.values ?? {};
  const fieldErrors = state.fieldErrors ?? {};

  if (state.status === "success" && state.success) {
    return (
      <ThankYou
        firstName={state.success.firstName}
        syncedToCrm={state.success.syncedToCrm}
        nextClassLabel={nextClassLabel}
      />
    );
  }

  return (
    <form action={formAction} className="tc-form" noValidate>
      {/* Honeypot. Off-screen rather than display:none — some bots skip
          hidden fields, and none of them skip a field a human never sees. */}
      <div className="tc-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" && state.error && (
        <p className="tc-form-error" role="alert">
          {state.error}
        </p>
      )}

      <Field
        name="firstName"
        label="First name"
        required
        autoComplete="given-name"
        defaultValue={values.firstName}
        error={fieldErrors.firstName}
      />
      <Field
        name="lastName"
        label="Last name"
        required
        autoComplete="family-name"
        defaultValue={values.lastName}
        error={fieldErrors.lastName}
      />
      <Field
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        required
        autoComplete="email"
        defaultValue={values.email}
        error={fieldErrors.email}
      />
      <Field
        name="phone"
        label="Mobile number"
        type="tel"
        inputMode="tel"
        required
        autoComplete="tel"
        defaultValue={values.phone}
        error={fieldErrors.phone}
      />
      <Field
        name="businessName"
        label="Business name"
        autoComplete="organization"
        defaultValue={values.businessName}
        error={fieldErrors.businessName}
      />
      <Field
        name="industry"
        label="What kind of work"
        defaultValue={values.industry}
        error={fieldErrors.industry}
      />

      <div className="tc-field tc-field-wide">
        <label className="tc-label-q" htmlFor="annoyance">
          What&apos;s the most annoying thing in your business right now?
          <span className="tc-req" aria-hidden="true">
            {" "}
            *
          </span>
        </label>
        <textarea
          id="annoyance"
          name="annoyance"
          required
          rows={4}
          defaultValue={values.annoyance}
          aria-invalid={fieldErrors.annoyance ? true : undefined}
          aria-describedby={
            fieldErrors.annoyance ? "annoyance-error annoyance-hint" : "annoyance-hint"
          }
          className={
            fieldErrors.annoyance ? "tc-textarea tc-input-error" : "tc-textarea"
          }
        />
        {fieldErrors.annoyance && (
          <p className="tc-error" id="annoyance-error">
            {fieldErrors.annoyance}
          </p>
        )}
        <p className="tc-hint" id="annoyance-hint">
          One sentence is plenty. We read these before every class, and they
          decide what we open with.
        </p>
      </div>

      <div className="tc-field-wide tc-submit-row">
        <button type="submit" className="tc-submit" disabled={pending}>
          {pending ? "Saving your spot…" : "Save my spot"}
        </button>
        <p className="tc-fineprint">
          We&apos;ll text you a confirmation and send the {CLASS_FACTS.platform} link
          before each class. Reply STOP any time and the texts end.
        </p>
      </div>
    </form>
  );
}

function ThankYou({
  firstName,
  syncedToCrm,
  nextClassLabel,
}: {
  firstName: string;
  syncedToCrm: boolean;
  nextClassLabel: string;
}) {
  return (
    <div className="tc-thanks">
      <h2 className="tc-thanks-title">
        You&apos;re on the list, {firstName}.
      </h2>
      <p className="tc-p">
        Registering once covers every week — you don&apos;t need to come back to
        this page again.
      </p>

      {!syncedToCrm && (
        <p className="tc-warn" role="alert">
          One thing worth saying plainly: our texting system didn&apos;t confirm
          just now. You are registered and we can see you on the list. If no text
          arrives in the next few minutes, email{" "}
          <a className="tc-link" href="mailto:info@creait.tech">
            info@creait.tech
          </a>{" "}
          and we&apos;ll sort it out by hand.
        </p>
      )}

      <div className="tc-rows tc-rows-tight">
        <div className="tc-row">
          <div className="tc-row-k">In a few minutes</div>
          <div className="tc-row-v">A text confirming you&apos;re in.</div>
        </div>
        <div className="tc-row">
          <div className="tc-row-k">The day before</div>
          <div className="tc-row-v">A reminder, so it doesn&apos;t sneak up on you.</div>
        </div>
        <div className="tc-row">
          <div className="tc-row-k">Tuesday morning</div>
          <div className="tc-row-v">
            The {CLASS_FACTS.platform} link. Same link every week.
          </div>
        </div>
        <div className="tc-row">
          <div className="tc-row-k">{nextClassLabel}</div>
          <div className="tc-row-v">
            {CLASS_FACTS.startTime}. Bring one real problem from your week.
          </div>
        </div>
      </div>

      <div className="tc-next">
        <h3 className="tc-next-title">
          Want your own numbers instead of the general version?
        </h3>
        <p className="tc-next-body">
          The class works on a business in the abstract. The Growth &amp; AI
          Diagnostic works on yours: it prices what&apos;s leaking, with the math
          shown beside every figure, and says &ldquo;not examined&rdquo; where we
          didn&apos;t look.
        </p>
        <a
          className="tc-next-link"
          href={CLASS_FACTS.fitCallUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Book a 15-minute fit call
        </a>
      </div>
    </div>
  );
}
