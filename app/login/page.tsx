import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Sign In - Slack AI App",
  description: "Sign in to your Slack AI App account",
}

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left panel - Form */}
      <div className="flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo & heading */}
          <div className="flex flex-col gap-2 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <svg
                  className="h-5 w-5 text-primary-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                  />
                </svg>
              </div>
              <span className="text-lg font-semibold text-foreground">Slack AI</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sign in to your account to continue managing your AI-powered Slack assistant.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>

      {/* Right panel - Decorative */}
      <div className="relative hidden lg:block bg-primary">
        <div className="absolute inset-0 flex flex-col items-center justify-center px-16">
          <div className="max-w-md text-center">
            <div className="mb-8 flex justify-center">
              <div className="rounded-2xl bg-primary-foreground/10 p-6 backdrop-blur-sm">
                <svg
                  className="h-16 w-16 text-primary-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                  />
                </svg>
              </div>
            </div>
            <blockquote className="text-xl font-medium text-primary-foreground leading-relaxed mb-4 text-balance">
              {'"Supercharge your team\'s productivity with AI that lives right where you work."'}
            </blockquote>
            <p className="text-sm text-primary-foreground/70">
              Smart replies, summaries, and insights — all inside Slack.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
