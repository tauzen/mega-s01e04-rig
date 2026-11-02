import type { Hono } from 'hono';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { DigestPage } from '../views/digest.js';
import type { NightReader } from './types.js';

export function registerDigestPage(app: Hono, runsDir: string, readNight: NightReader): void {
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readNight(runsDir, night);

    if (result === null) return c.notFound();

    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage night={night} result={result} />
      </Layout>,
    );
  });
}
