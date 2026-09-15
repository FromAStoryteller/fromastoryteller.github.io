import test from 'node:test';
import assert from 'node:assert/strict';
import {readingTimeFromHtml, storyBodyHtml} from '../content/reading-time.mjs';

test('reading estimate rounds upward at the 225-word boundary', () => {
  assert.deepEqual(readingTimeFromHtml('word '.repeat(225)), {words:225,minutes:1});
  assert.deepEqual(readingTimeFromHtml('word '.repeat(226)), {words:226,minutes:2});
  assert.deepEqual(readingTimeFromHtml(''), {words:0,minutes:1});
});
test('formatting, punctuation and hidden markup do not inflate the word count', () => {
  assert.equal(readingTimeFromHtml('<p>don&rsquo;t stop—go <em>on</em>.</p><!-- not words --><script>not words</script><p>co-operate &#65; &amp; B</p>').words, 7);
  assert.equal(readingTimeFromHtml('<p>un<em>break</em>able</p>').words, 1);
});
test('only the prose section is measured, including nested sections', () => {
  const page='<h1>Title outside</h1><section class="story-content"><p>One two</p><section>three</section></section><nav>More words outside</nav>';
  assert.equal(readingTimeFromHtml(storyBodyHtml(page)).words,3);
  assert.equal(storyBodyHtml('<article>No prose</article>'),null);
});
