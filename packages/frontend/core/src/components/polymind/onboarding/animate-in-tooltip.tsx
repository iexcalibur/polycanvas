import { Button } from '@polycanvas/component';

import * as styles from './animate-in-tooltip.css';

interface AnimateInTooltipProps {
  onNext: () => void;
  visible?: boolean;
}

export const AnimateInTooltip = ({
  onNext,
  visible,
}: AnimateInTooltipProps) => {
  return (
    <>
      <div className={styles.tooltip}>
        PolyCanvas is an infinite canvas for sketching, <br />
        diagramming and thinking visually
      </div>
      <div className={styles.next}>
        {visible ? (
          <Button variant="primary" size="extraLarge" onClick={onNext}>
            Next
          </Button>
        ) : null}
      </div>
    </>
  );
};
