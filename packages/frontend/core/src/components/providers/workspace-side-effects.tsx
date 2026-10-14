import { useRegisterFindInPageCommands } from '@polycanvas/core/components/hooks/polymind/use-register-find-in-page-commands';
import { useRegisterWorkspaceCommands } from '@polycanvas/core/components/hooks/use-register-workspace-commands';
import { OverCapacityNotification } from '@polycanvas/core/components/over-capacity';
import { useRegisterNavigationCommands } from '@polycanvas/core/modules/navigation/view/use-register-navigation-commands';
import { QuickSearchContainer } from '@polycanvas/core/modules/quicksearch';

/**
 * @deprecated just for legacy code, will be removed in the future
 */
export const WorkspaceSideEffects = () => {
  useRegisterWorkspaceCommands();
  useRegisterNavigationCommands();
  useRegisterFindInPageCommands();

  return (
    <>
      <QuickSearchContainer />
      <OverCapacityNotification />
    </>
  );
};
