import Mail from '../../lib/Mail';

class SubscriptionMail {
  get key() {
    return 'SubscriptionMail';
  }

  async handle({ data }) {
    const { meetup, userName, userEmail } = data;
    await Mail.sendMail({
      to: `${meetup.user.name} <${meetup.user.email}>`,
      subject: 'Inscrição no Meetup',
      template: 'subscription',
      context: {
        userMeetup: meetup.user.name,
        user: userName,
        email: userEmail,
      },
    });
  }
}

export default new SubscriptionMail();
