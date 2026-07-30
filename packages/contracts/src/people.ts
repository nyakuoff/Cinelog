import { z } from 'zod';
import { SearchResult } from './media.js';

/**
 * A person's filmography page — "what else have they made", reached by clicking
 * a director or an actor on a title.
 *
 * People are not cached as Cinelog records: there is nothing user-owned to hang
 * off a person, so this is read straight from the metadata provider. Each credit
 * is a plain search result, so opening one goes through the same resolve path as
 * any other poster in the app.
 */
export const PersonCredit = SearchResult.extend({
  /** The part played, for acting credits. */
  character: z.string().nullable(),
  /** The job done, for crew credits (Director, Writer, …). */
  job: z.string().nullable(),
});
export type PersonCredit = z.infer<typeof PersonCredit>;

export const PersonDetail = z.object({
  /** The provider's own id for this person, e.g. a TMDB person id. */
  id: z.string(),
  name: z.string(),
  biography: z.string().nullable(),
  birthday: z.string().nullable(),
  deathday: z.string().nullable(),
  placeOfBirth: z.string().nullable(),
  /** What they're chiefly known for — "Acting", "Directing", … */
  knownForDepartment: z.string().nullable(),
  profileUrl: z.string().nullable(),
  /** Everything they appeared in, most prominent first. */
  acting: z.array(PersonCredit),
  /** Everything they worked on behind the camera. */
  crew: z.array(PersonCredit),
});
export type PersonDetail = z.infer<typeof PersonDetail>;
