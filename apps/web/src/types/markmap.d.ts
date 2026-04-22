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

declare module 'markmap-lib' {
  export class Transformer {
    transform(markdown: string): { root: any };
  }
}

declare module 'markmap-view' {
  export const Markmap: {
    create(el: SVGSVGElement, options?: Record<string, any>): {
      setData(root: any): Promise<void>;
      fit(): Promise<void>;
    };
  };
}

declare module 'markmap-toolbar' {
  export class Toolbar {
    static defaultItems: string[];
    attach(markmap: any): void;
    register(button: any): void;
    setItems(items: string[]): void;
    render(): HTMLElement;
  }
}

declare module 'markmap-common' {
  export function loadCSS(...args: any[]): Promise<void>;
  export function loadJS(...args: any[]): Promise<void>;
}
