import { Notification } from 'electron'

export const notificationService = {
  postSuccess(summary) {
    const { exported, updated } = summary
    const body = exported + updated > 0
      ? `Exported ${exported} new, updated ${updated} files.`
      : 'All photos already up to date.'
    new Notification({ title: 'Backup Complete', body }).show()
  },

  postFailure(error) {
    new Notification({
      title: 'Backup Failed',
      body: error ?? 'An unknown error occurred.',
    }).show()
  },

  postInterrupted() {
    new Notification({
      title: 'Backup Stopped',
      body: 'Backup was interrupted. Your next run will resume where it left off.',
    }).show()
  },
}
