/**
 * Creates a markdown log file and returns an append function.
 */
import { writeFile, appendFile, mkdir } from "fs/promises";
import { dirname } from "path";

export const createFileLogger = async (path) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "");
  return (text) => appendFile(path, text);
};
