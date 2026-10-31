import { PUBLISH_STEPS } from '../csv/sheetUrl';
import './LoadUrlDialog.css';

/** The steps for publishing a Google Sheet as CSV, shown for an edit link (CD-8). */
export function PublishHowTo() {
  return (
    <>
      <p className="load-url__note">To load a Google Sheet, publish it as CSV:</p>
      <ol className="load-url__steps">
        {PUBLISH_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </>
  );
}
