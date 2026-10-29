import { Component, type ReactNode } from "react";

// Isolates a dashboard section so a render error in it shows a local fallback
// instead of unmounting the whole admin dashboard. Used around the fulfillment
// analytics card, which fetches/derives data that can vary by environment.
export default class AdminSectionBoundary extends Component<
  { children: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Surface in the console for debugging; never rethrow.
    console.error("Admin section error:", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="fulfillment-analytics__notice fulfillment-analytics__notice--error"
        >
          <h3>{this.props.label ?? "This section"} couldn’t be displayed</h3>
          <p>Something went wrong rendering this panel. The rest of the dashboard is unaffected.</p>
          <button type="button" onClick={() => this.setState({ failed: false })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
