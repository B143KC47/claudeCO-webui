import { assertEquals } from "jsr:@std/assert@1";
import { convertWindowsPathToWSL } from "./pathUtils.ts";

Deno.test("convertWindowsPathToWSL - Windows drive paths", () => {
  // Standard Windows paths
  assertEquals(
    convertWindowsPathToWSL("C:\\Users\\ko202\\Desktop"),
    "/mnt/c/Users/ko202/Desktop",
  );

  assertEquals(
    convertWindowsPathToWSL("D:\\Projects\\myapp"),
    "/mnt/d/Projects/myapp",
  );

  // Windows paths with forward slashes
  assertEquals(
    convertWindowsPathToWSL("C:/Users/ko202/Documents"),
    "/mnt/c/Users/ko202/Documents",
  );

  // Mixed slashes
  assertEquals(
    convertWindowsPathToWSL("C:\\Users/ko202\\Desktop\\project"),
    "/mnt/c/Users/ko202/Desktop/project",
  );
});

Deno.test("convertWindowsPathToWSL - WSL network paths", () => {
  // WSL$ paths
  assertEquals(
    convertWindowsPathToWSL("\\\\wsl$\\Ubuntu\\home\\user"),
    "/home/user",
  );

  assertEquals(
    convertWindowsPathToWSL("\\\\wsl$\\Ubuntu-20.04\\home\\user\\projects"),
    "/home/user/projects",
  );

  // WSL.localhost paths
  assertEquals(
    convertWindowsPathToWSL("\\\\wsl.localhost\\Ubuntu\\home\\user"),
    "/home/user",
  );
});

Deno.test("convertWindowsPathToWSL - Unix/Linux paths", () => {
  // Already Unix paths - should remain unchanged
  assertEquals(
    convertWindowsPathToWSL("/mnt/c/Users/ko202/Desktop"),
    "/mnt/c/Users/ko202/Desktop",
  );

  assertEquals(
    convertWindowsPathToWSL("/home/user/projects"),
    "/home/user/projects",
  );

  assertEquals(
    convertWindowsPathToWSL("/usr/local/bin"),
    "/usr/local/bin",
  );
});

Deno.test("convertWindowsPathToWSL - Edge cases", () => {
  // UNC paths
  assertEquals(
    convertWindowsPathToWSL("\\\\server\\share\\folder"),
    "//server/share/folder",
  );

  // Relative paths (just replace backslashes)
  assertEquals(
    convertWindowsPathToWSL("folder\\subfolder"),
    "folder/subfolder",
  );

  // Empty path
  assertEquals(
    convertWindowsPathToWSL(""),
    "",
  );

  // Root Windows path
  assertEquals(
    convertWindowsPathToWSL("C:\\"),
    "/mnt/c/",
  );
});
