import type { DigestResult } from '../digest/types.js';

export function DigestPage({ night, result }: { night: string; result: DigestResult }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {result.badLines > 0 && <p class="warn">bad lines: {result.badLines}</p>}
      {result.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first time</th>
              <th>last time</th>
              <th>warnings</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => {
              const warnings = [
                ...(row.retries >= 3 ? ['retries ≥ 3'] : []),
                ...(row.hasFailure ? ['failure seen'] : []),
              ];

              return (
                <tr>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries >= 3 ? <span class="warn">{row.retries}</span> : row.retries}</td>
                  <td>{row.hasFailure ? <span class="warn">{row.lastStatus}</span> : row.lastStatus}</td>
                  <td>{row.lastError ?? '—'}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                  <td>{warnings.length > 0 ? <span class="warn">{warnings.join(', ')}</span> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
