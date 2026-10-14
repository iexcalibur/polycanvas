import { persistentConfig } from '../config-storage/persist';
import { logger } from '../logger';
import { initAndShowMainWindow } from './main-window';
import { launchStage } from './stage';

/**
 * Launch app depending on launch stage
 */
export async function launch() {
  // Always go straight to main window — mark onboarding as done
  if (launchStage.value === 'onboarding') {
    launchStage.value = 'main';
    persistentConfig.patch('onBoarding', false);
  }
  initAndShowMainWindow().catch(e => {
    logger.error('Failed to restore or create window:', e);
  });
}
