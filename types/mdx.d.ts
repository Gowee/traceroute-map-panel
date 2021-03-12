const MDXComponent: (props: any) => JSX.Element;

declare module '*.md' {
    export default MDXComponent;
}

declare module '*.mdx' {
    export default MDXComponent;
}

// Ref: https://v0.mdxjs.com/advanced/typescript
// Ref: https://github.com/mdx-js/mdx/blob/main/packages/loader/types/index.d.ts
//      which does not work and is not released yet.
