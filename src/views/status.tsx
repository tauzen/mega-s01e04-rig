import type { Status } from '../status.js';

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <>
          <p class="mute">Counts are valid log events, not final job states.</p>
          <table>
            <thead>
              <tr>
                <th scope="col">night</th>
                <th scope="col">ok events</th>
                <th scope="col">retry events</th>
                <th scope="col">fail events</th>
              </tr>
            </thead>
            <tbody>
              {status.nights.map((night) => {
                const counts = status.nightCounts?.[night];
                return (
                  <tr>
                    <th scope="row"><a href={`/digest/${night}`}>{night}</a></th>
                    <td>{counts ? counts.ok : '—'}</td>
                    <td>{counts ? counts.retry : '—'}</td>
                    <td>{counts ? counts.fail : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
