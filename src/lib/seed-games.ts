// A complete, ready-to-play game so the board is never empty. General knowledge,
// aimed at "fun with friends" — anyone at the table should be able to shout
// something out. Edit or delete it freely from the dashboard.
//
// Shared by `npm run seed` (prisma/seed.ts) and the first-boot seed that runs
// when a fresh deployment finds an empty library.

export type SeedClue = { q: string; a: string; dd?: boolean };
export type SeedCategory = { name: string; clues: SeedClue[] };
export type SeedGame = {
  title: string;
  round1: SeedCategory[];
  round2: SeedCategory[];
  finalCategory: string;
  finalClue: string;
  finalAnswer: string;
};

const sampleGame: SeedGame = {
  title: "General Trivia — Sample Game",
  round1: [
    {
      name: "WORLD GEOGRAPHY",
      clues: [
        { q: "This country's capital is Canberra, not Sydney.", a: "Australia" },
        { q: "The Sahara covers much of the north of this continent.", a: "Africa" },
        {
          q: "Opened in 1914, this Central American canal links two oceans.",
          a: "The Panama Canal",
        },
        { q: "Mount Kilimanjaro rises in this East African country.", a: "Tanzania" },
        { q: "The kingdom of Lesotho is entirely surrounded by this country.", a: "South Africa" },
      ],
    },
    {
      name: "SPACE",
      clues: [
        { q: "This neighboring world is known as the Red Planet.", a: "Mars" },
        { q: "The closest star to Earth.", a: "The Sun" },
        { q: "The largest planet in our solar system.", a: "Jupiter" },
        {
          q: "In 1969 this astronaut followed Neil Armstrong onto the Moon's surface.",
          a: "Buzz Aldrin",
        },
        { q: "Titan is the largest moon of this ringed planet.", a: "Saturn" },
      ],
    },
    {
      name: "IN THE KITCHEN",
      clues: [
        { q: "The main ingredient in guacamole.", a: "Avocado" },
        { q: "This living fungus makes bread dough rise.", a: "Yeast" },
        { q: "Arborio rice is the usual choice for this creamy Italian dish.", a: "Risotto" },
        { q: "The French word \"sauter,\" source of \"sauté,\" means this.", a: "To jump" },
        { q: "The spice saffron is harvested from this flower.", a: "The crocus" },
      ],
    },
    {
      name: "ANIMAL KINGDOM",
      clues: [
        { q: "The fastest land animal in the world.", a: "The cheetah" },
        { q: "A group of lions goes by this name.", a: "A pride" },
        { q: "The largest animal known to have ever lived.", a: "The blue whale" },
        { q: "These are the only mammals capable of true powered flight.", a: "Bats" },
        { q: "An octopus has this many hearts.", a: "Three" },
      ],
    },
    {
      name: "BOOKS",
      clues: [
        { q: "This author created the boy wizard Harry Potter.", a: "J.K. Rowling" },
        { q: "Herman Melville's novel about the hunt for a white whale.", a: "Moby-Dick" },
        { q: "This American author gave us Jay Gatsby.", a: "F. Scott Fitzgerald" },
        { q: "Mary Shelley published this novel about a scientist's creature in 1818.", a: "Frankenstein", dd: true },
        {
          q: "Gabriel García Márquez traced the Buendía family through this 1967 novel.",
          a: "One Hundred Years of Solitude",
        },
      ],
    },
  ],
  round2: [
    {
      name: "WORLD HISTORY",
      clues: [
        { q: "This ship sank on its maiden voyage in April 1912.", a: "The Titanic" },
        { q: "The wall dividing this German city came down in 1989.", a: "Berlin" },
        { q: "King John of England agreed to this charter in 1215.", a: "The Magna Carta" },
        { q: "This general crowned himself Emperor of the French in 1804.", a: "Napoleon Bonaparte" },
        { q: "This Andean empire built the mountain citadel of Machu Picchu.", a: "The Inca", dd: true },
      ],
    },
    {
      name: "SCIENCE LAB",
      clues: [
        { q: "The force that keeps your feet on the ground.", a: "Gravity" },
        { q: "The element with the chemical symbol Au.", a: "Gold" },
        { q: "The most abundant gas in Earth's atmosphere.", a: "Nitrogen" },
        { q: "In table salt, NaCl, the Na stands for this element.", a: "Sodium", dd: true },
        { q: "The SI unit of electrical resistance.", a: "The ohm" },
      ],
    },
    {
      name: "MUSIC",
      clues: [
        { q: "A standard one of these instruments has 88 keys.", a: "The piano" },
        { q: "John, Paul, George, and Ringo formed this Liverpool band.", a: "The Beatles" },
        { q: "Freddie Mercury fronted this British rock band.", a: "Queen" },
        { q: "This singer released the album \"Thriller\" in 1982.", a: "Michael Jackson" },
        {
          q: "This German composer wrote his Ninth Symphony while almost entirely deaf.",
          a: "Ludwig van Beethoven",
        },
      ],
    },
    {
      name: "SPORTS",
      clues: [
        { q: "The number of rings on the Olympic flag.", a: "Five" },
        { q: "The Wimbledon tennis championships are played on this surface.", a: "Grass" },
        { q: "The overall leader of the Tour de France wears a jersey of this color.", a: "Yellow" },
        { q: "A perfect score in ten-pin bowling.", a: "300" },
        { q: "This country hosted the first modern Olympics in 1896.", a: "Greece" },
      ],
    },
    {
      name: "WORDS & LANGUAGE",
      clues: [
        { q: "A word that means the opposite of another word.", a: "An antonym" },
        { q: "A word like \"level\" that reads the same in both directions.", a: "A palindrome" },
        { q: "This Latin phrase means \"seize the day.\"", a: "Carpe diem" },
        { q: "The language with the most native speakers in the world.", a: "Mandarin Chinese" },
        { q: "The term for a word like \"buzz\" that imitates a sound.", a: "Onomatopoeia" },
      ],
    },
  ],
  finalCategory: "FAMOUS LANDMARKS",
  finalClue:
    "Built for the 1889 World's Fair, this Paris landmark was originally meant to stand for only 20 years.",
  finalAnswer: "The Eiffel Tower",
};

export const SEED_GAMES = [sampleGame];

/** Reshape a seed game into the payload `importGame` accepts. */
export function toImportPayload(seed: SeedGame) {
  const toCategories = (categories: SeedCategory[], round: number) =>
    categories.map((category, position) => ({
      name: category.name,
      round,
      position,
      clues: category.clues.map((clue, cluePosition) => ({
        position: cluePosition,
        clue: clue.q,
        answer: clue.a,
        isDailyDouble: clue.dd ?? false,
      })),
    }));

  return {
    title: seed.title,
    finalCategory: seed.finalCategory,
    finalClue: seed.finalClue,
    finalAnswer: seed.finalAnswer,
    categories: [
      ...toCategories(seed.round1, 1),
      ...toCategories(seed.round2, 2),
    ],
  };
}
