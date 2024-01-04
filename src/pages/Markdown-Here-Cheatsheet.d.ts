/* 
// This is a TypeScript declaration file. It's used to declare the types of non-JavaScript modules so that TypeScript can understand them.

// Here we are declaring a module for all files with the ".md" extension (Markdown files).
// This is useful when you want to import Markdown files directly in your TypeScript/JavaScript files.
// Without this declaration, TypeScript would throw an error because it doesn't know the type of ".md" files.
declare module "*.md" {
  // The actual types of the module would go here.
  // For example, if you're using a loader that converts Markdown files to strings, you could write:
  // const content: string;
  // export default content;
  // But in this case, no specific type is declared, so any import of an ".md" file will be of type 'any'. */
declare module "*.md" {
  const value: string;
  export default value;
}
