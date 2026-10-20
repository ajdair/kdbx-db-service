// Text for the question-mark tooltips that appear beside form fields.
export const FILTER_HELP = `Filters are [operator, column, value] triples. Operators: = <> < > <= >= in like within. Nest with and, or, not inside the list, for example [["or", ["=","sym","EURUSD"], ["=","sym","USDJPY"]]].`;

export const START_HELP =
  "Inclusive: rows at exactly this time are included. It is read in the input timezone. It defaults to the start of the latest day with data in the table.";
export const END_HELP =
  "Exclusive: rows at exactly this time are left out. It is read in the input timezone.";
export const LIMIT_HELP =
  "Maximum number of rows returned. A limit is always sent, because a large unaggregated result can run the aggregator out of memory.";
export const GROUP_BY_HELP =
  "Column names separated by commas, for example sym or sym,trddate. Use it with aggregations.";
export const AGG_HELP =
  "One per line as out,fn,col, for example avg_bid,avg,bid. Leave it empty to return the raw columns. Functions: all, any, avg, cor, count, cov, dev, distinct, first, last, max, min, prd, scov, sdev, sum, svar, var, wavg, wsum.";
export const FILL_HELP =
  "Replaces null values. Forward uses the previous non-null value. Zero uses the zero value for the column type.";
export const TEMPORALITY_HELP =
  "Snapshot returns one block of data from start to end. Slice returns the same time of day for each date in the range, for example 10:00 to 13:00 on each day.";
export const SORT_HELP =
  "Column names separated by commas. They are sorted after the query runs.";
export const INPUT_TZ_HELP =
  "Timezone used to read start and end, in tz database format such as America/New_York. Defaults to UTC.";
export const OUTPUT_TZ_HELP =
  "Timezone that timestamps in the result are converted to. Defaults to UTC. Pick the columns to convert in the next field.";
export const TZ_COLS_HELP =
  "Timestamp columns to convert to the output timezone, separated by commas.";
export const LABELS_HELP =
  "One key=value per line. The query runs on every assembly that has these labels, which is useful when several databases are configured. Leave it empty for a single assembly.";

export const MERGE_LAMBDA_HELP =
  "Optional. A q lambda that receives the list of per-tier results and returns one combined result, for example {select n:sum n from raze x}.";

export const INGEST = {
  rows: "A JSON array of objects, or a JSON array of arrays when you give column names under Advanced options.",
  createInline:
    "Creates the table first. Column types are required to create a table from inline data, so set Types under Advanced options. The table is created partitioned, with the first timestamp column as the partition column.",
  columnNamesInline:
    "Comma separated. Required when the rows are arrays. Not needed for objects, which carry their own names.",
  typesInline:
    "One letter per column, in column order (q cast string, for example sff). Required to create a table. Click to open the q cast reference.",
  mode: "Merge adds the new data to dates that already have data. Overwrite replaces those dates. It applies per date partition.",
  path: "A file name or glob, relative to the service's imports folder (data/imports/ on the host).",
  createFile:
    "Creates the table first. Its column names come from the file header, or from the column names under Advanced options.",
  columnNamesFile:
    "Comma separated. Overrides the names in the header, by position. Required when the file has no header and you use post-parse transforms or leave columns unused.",
  headerRow:
    "The row, counted from 0, where the header starts. Use -1 when the file has no header. A value above 0 skips leading rows such as comments.",
  typesFile:
    "One uppercase letter per column (q parse string, for example PSFF, with * for a string). Click to open the q parse reference.",
  include:
    "Comma separated column names to carry forward, including columns made by post-parse transforms. Delimited text only.",
  postparse:
    'A JSON object of column name to q expression. It can change existing columns or create new ones, and can read other columns, for example {"sprd": "(data`ask)-data`bid"}. Delimited text only.',
  hdbPath:
    "The path of a kdb HDB directory, relative to the service's imports folder.",
  createKdb: "Creates any table in the HDB that does not exist yet.",
};
