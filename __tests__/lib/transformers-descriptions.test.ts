import { describe, it, expect } from 'vitest';
import { transformProgram, transformSession } from '@/lib/transformers';

describe('description handling in transformers', () => {
  it('keeps the legacy stripHtml behavior for previously-decoded entities', () => {
    const program = transformProgram({
      id: 1,
      name: 'Test',
      description: '<p>Soccer &amp; more &lt;3 &quot;fun&quot; kids&#39; camp&nbsp;here</p>',
    });
    expect(program.description).toBe('Soccer & more <3 "fun" kids\' camp here');
  });

  it('decodes entities that previously rendered literally', () => {
    const session = transformSession({
      id: 10,
      programId: 1,
      name: 'Ballerz',
      description: 'Ages 5&ndash;7, the Midwest&rsquo;s best &hellip; and more &#8211; really',
    });
    expect(session.description).toBe('Ages 5–7, the Midwest’s best … and more – really');
  });

  it('populates sanitized descriptionHtml on sessions', () => {
    const session = transformSession({
      id: 10,
      programId: 1,
      name: 'Ballerz',
      description: '<p onclick="x()">Ages 5&ndash;7 <strong>fundamentals</strong></p><script>bad()</script>',
    });
    expect(session.descriptionHtml).toBe('<p>Ages 5&ndash;7 <strong>fundamentals</strong></p>');
    // Plain-text field still stripped for existing consumers
    expect(session.description).toBe('Ages 5–7 fundamentalsbad()');
  });

  it('leaves descriptionHtml undefined when the description is empty', () => {
    const session = transformSession({ id: 10, programId: 1, name: 'No copy' });
    expect(session.descriptionHtml).toBeUndefined();
    expect(session.longDescriptionHtml).toBeUndefined();
    expect(session.description).toBeUndefined();
  });

  it('populates sanitized longDescriptionHtml on sessions', () => {
    const session = transformSession({
      id: 10,
      programId: 1,
      name: 'Ballerz',
      longDescription: '<p>Full details with <em>emphasis</em></p><script>x()</script>',
    });
    expect(session.longDescriptionHtml).toBe('<p>Full details with <em>emphasis</em></p>');
  });

  it('flows session descriptionHtml through transformProgram', () => {
    const program = transformProgram({
      id: 1,
      name: 'Test',
      sessions: [
        { id: 10, programId: 1, name: 'S1', description: '<p>Hello <em>there</em></p>' },
      ],
    });
    const sessions = Array.isArray(program.sessions) ? program.sessions : [];
    expect(sessions[0]?.descriptionHtml).toBe('<p>Hello <em>there</em></p>');
  });
});
