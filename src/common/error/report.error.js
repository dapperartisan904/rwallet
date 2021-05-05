import { getSystemName } from 'react-native-device-info';
import VersionNumber from 'react-native-version-number';
import ParseHelper from '../parse';

/**
 * Handles error getting the user and the error if it can't send to the server. Both of these
 * errors need to be caught so they don't crash the app.
 */
const handleError = (error) => console.log(error);

/**
 * Creates a report in JSON format and sends it to the server to be saved
 * @param {object} data
 * @param {Object} data.developerComment {string} a comment added by a developer for extra context
 * @param {Object} data.errorObject {Error} the error that was thrown
 * @param {Object} data.additionalInfo {Object} an optional JSON object that can provide extra information
 */
const ReportErrorToServer = ({ developerComment, errorObject, additionalInfo }) => ParseHelper.getUser()
  .then((parseUser) => {
    // create the object to be sent
    const toServerObject = {
      comment: developerComment || '',
      additionalInfo: additionalInfo ? JSON.stringify(additionalInfo) : '',
      errorObject: {
        code: errorObject.code,
        message: errorObject.message,
        stack: errorObject.stack.toString(),
      },
      userId: parseUser.id,
      username: parseUser.getUsername(),
      platform: getSystemName(),
      appVersion: VersionNumber.appVersion,
    };

    // console.log will be removed in the future
    console.log('[ReportErrorToServer]', toServerObject);

    // send object to server
    ParseHelper.sendErrorReport(toServerObject).catch(handleError);
  })
  .catch(handleError);

export default ReportErrorToServer;
