const defaultActivationWindowMs = 500;

export class TrayActivationGuard {
  private ignoreBlurUntil = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly activationWindowMs = defaultActivationWindowMs
  ) {}

  beginActivation() {
    this.ignoreBlurUntil = this.now() + this.activationWindowMs;
  }

  shouldIgnoreBlur() {
    return this.now() < this.ignoreBlurUntil;
  }

  finishActivation() {
    this.ignoreBlurUntil = 0;
  }
}
