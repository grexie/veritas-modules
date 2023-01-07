import path from "path";
import fs from "fs";
import { Configuration, EntryObject } from "webpack";
import glob from "glob";
import GenerateJSONPlugin from "generate-json-webpack-plugin";

interface Config {
  routes: Route[];
  defaultRoute: Omit<Route, "domain">;
}

interface Route {
  domain: string | string[];
  manifest: string;
}

interface Manifest {
  domain: string;
  main: string;
}

const createModules = (files: string[]) => {
  const config: Config = {
    routes: [],
    ...JSON.parse(
      fs
        .readFileSync(path.resolve(__dirname, "src", "app-config.json"))
        .toString()
    ),
  } as any;
  const manifests: Record<string, Manifest> = {};
  const entry: EntryObject = {};

  for (let file of files) {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "src", file)).toString()
    );
    if (!manifest.domain) {
      continue;
    }
    if (manifest.main) {
      const main = manifest.main;
      manifest.main = "./grexie-veritas.js";
      entry[
        path.join(path.dirname(file), "grexie-veritas")
      ] = `./${path.relative(
        path.resolve(__dirname, "src"),
        path.resolve(__dirname, "src", path.dirname(file), main)
      )}`;
    }
    manifests[file] = manifest;
    if (manifest.domain) {
      config.routes.push({
        domain: manifest.domain,
        manifest: `./${file}`,
      });
    }
  }

  if (config.defaultRoute) {
    const manifestPath = path.relative(
      path.resolve(__dirname, "src"),
      path.resolve(__dirname, "src", config.defaultRoute.manifest)
    );
    const manifest: Manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "src", manifestPath)).toString()
    );
    if (manifest.main) {
      const main = manifest.main;
      manifest.main = "./grexie-veritas.js";
      entry[
        path.join(path.dirname(manifestPath), "grexie-veritas")
      ] = `./${path.relative(
        path.resolve(__dirname, "src"),
        path.resolve(__dirname, "src", path.dirname(manifestPath), main)
      )}`;
    }
    manifests[manifestPath] = manifest;
    if (manifest.domain) {
      config.routes.push({
        manifest: `./${manifestPath}`,
      } as any);
    }
  }

  return { config, manifests, entry };
};

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const modules = createModules(
  glob.sync("domains/**/manifest.json", {
    cwd: path.resolve(__dirname, "src"),
  })
);

const config: Configuration = {
  context: path.resolve(__dirname, "src"),
  entry: modules.entry,
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  output: {
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  target: "webworker",
  module: {
    rules: [
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: ["css-loader"],
      },
      {
        test: /\.s[ac]ss$/,
        exclude: /\.module\.s[ac]ss$/,
        use: ["css-loader", "sass-loader"],
      },
      {
        test: /\.module\.css$/,
        use: [
          {
            loader: "css-loader",
            options: {
              modules: true,
            },
          },
        ],
      },
      {
        test: /\.module\.s[ac]ss$/,
        use: [
          {
            loader: "css-loader",
            options: {
              modules: true,
            },
          },
          "sass-loader",
        ],
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: "@svgr/webpack",
            options: { dimensions: false, icon: true },
          },
        ],
      },
      {
        test: /\.tsx?$/,
        use: ["babel-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"],
  },
  plugins: [
    new GenerateJSONPlugin("app-config.json", modules.config, null, 2) as any,
    ...Object.entries(modules.manifests).map(
      ([filename, asset]) =>
        new GenerateJSONPlugin(filename, asset, null, 2) as any
    ),
  ],
};

export default config;
