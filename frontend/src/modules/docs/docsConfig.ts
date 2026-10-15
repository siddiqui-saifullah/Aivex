import {
    Introduction,
    GettingStarted,
    FileSystem,
    MongoSetup,
    Runtime,
    CommonErrors,
} from "./sections";

export const docsConfig = [
    {
        title: "Introduction",
        path: "introduction",
        component: Introduction,
    },
    {
        title: "Getting Started",
        path: "getting-started",
        component: GettingStarted,
    },
    {
        title: "File System",
        path: "file-system",
        component: FileSystem,
    },
    {
        title: "Setting Up Database",
        path: "setting-up-database",
        component: MongoSetup,
    },
    {
        title: "Runtime & Execution Model",
        path: "runtime-execution-model",
        component: Runtime,
    },
    {
        title: "Common Errors",
        path: "common-errors",
        component: CommonErrors,
    },
];
