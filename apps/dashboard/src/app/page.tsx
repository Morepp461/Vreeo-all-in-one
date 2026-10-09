export default function HomePage() {
  return (
    <main className="shell">
      <div className="eyebrow">VREEO PLATFORM</div>
      <h1>One place to manage your Discord community.</h1>
      <p className="intro">
        The dashboard foundation is online. Authentication, guild access, configuration panels,
        and feature modules will be added behind server-side authorization.
      </p>
      <div className="status" role="status">
        <span className="dot" aria-hidden="true" />
        Foundation in progress
      </div>
      <footer>VREEO · AI is not part of V1</footer>
    </main>
  );
}
