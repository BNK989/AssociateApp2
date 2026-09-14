import { useMeasuredSize } from './useMeasuredSize';

/**
 * The live pixel height of an element, for animating a box open around content
 * whose height nobody knows in advance. The height half of `useMeasuredSize`;
 * the reasoning -- why measure, why not framer's `layout`, why observe rather
 * than read once -- lives there.
 */
export function useMeasuredHeight<T extends HTMLElement>() {
    const { ref, height } = useMeasuredSize<T>();
    return { ref, height };
}
