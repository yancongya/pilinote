declare module 'markmap' {
  interface MarkmapOptions {
    color?: (node: any) => string;
    [key: string]: any;
  }

  interface Markmap {
    (root: any, options?: MarkmapOptions, ...args: any[]): any;
    create(el: SVGSVGElement, options?: MarkmapOptions, data?: string): any;
  }

  export const Markmap: Markmap;
  export default Markmap;
}