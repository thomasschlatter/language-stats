# German word-frequency data

`de_50k.txt` — the 50,000 most frequent German words with their occurrence
counts, one `word count` pair per line, sorted most-frequent first.

## Provenance

- Derived from the **OpenSubtitles** corpus (subtitles from opensubtitles.org).
- Frequency list compiled by **hermitdave/FrequencyWords**
  (https://github.com/hermitdave/FrequencyWords), 2018 content set,
  file `content/2018/de/de_50k.txt`.
- The FrequencyWords project is MIT-licensed; the underlying OpenSubtitles
  data originates from opensubtitles.org.

Because it is built from spoken-style subtitle dialogue, this list is a good
proxy for the vocabulary of everyday spoken German — which is exactly what the
"how many words cover X% of conversation" feature reports.

## How it's used

`npm run seed` loads this file into the `word_frequencies` table and
pre-computes cumulative coverage, so the API can answer "which words make up
50% / 75% / 90% / 95% of spoken German".
