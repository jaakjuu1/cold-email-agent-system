import { useState } from 'react';
import {
  User,
  Mail,
  Key,
  Bell,
  Globe,
  Zap,
  CreditCard,
  Shield,
  Save,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';

type SettingsTab = 'profile' | 'email' | 'integrations' | 'notifications' | 'billing';

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'email' as const, label: 'Email Settings', icon: Mail },
    { id: 'integrations' as const, label: 'Integrations', icon: Zap },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
        <p className="mt-1 text-surface-500">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <nav className="lg:w-64 flex-shrink-0">
          <div className="card p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-surface-600 hover:bg-surface-50'
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 mb-4">
                  Profile Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="label">
                      Full Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      defaultValue="John Doe"
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="label">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      defaultValue="john@company.com"
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="company" className="label">
                      Company Name
                    </label>
                    <input
                      id="company"
                      type="text"
                      defaultValue="Acme Inc"
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="website" className="label">
                      Company Website
                    </label>
                    <input
                      id="website"
                      type="url"
                      defaultValue="https://acme.com"
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-200">
                <button onClick={handleSave} className="btn-primary">
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 mb-4">
                  Email Configuration
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="from_email" className="label">
                      Send From Email
                    </label>
                    <input
                      id="from_email"
                      type="email"
                      defaultValue="outreach@company.com"
                      className="input"
                    />
                    <p className="mt-1 text-sm text-surface-500">
                      Make sure this email is verified with your email provider.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="from_name" className="label">
                      Sender Name
                    </label>
                    <input
                      id="from_name"
                      type="text"
                      defaultValue="John from Acme"
                      className="input"
                    />
                  </div>

                  <div>
                    <label htmlFor="signature" className="label">
                      Email Signature
                    </label>
                    <textarea
                      id="signature"
                      rows={4}
                      defaultValue="Best regards,
John Doe
Sales Director, Acme Inc
john@acme.com | (555) 123-4567"
                      className="input resize-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-surface-900 mb-3">
                  Daily Sending Limits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="daily_limit" className="label">
                      Max Emails Per Day
                    </label>
                    <input
                      id="daily_limit"
                      type="number"
                      defaultValue={100}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="delay" className="label">
                      Delay Between Emails (seconds)
                    </label>
                    <input
                      id="delay"
                      type="number"
                      defaultValue={30}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-200">
                <button onClick={handleSave} className="btn-primary">
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">
                API Integrations
              </h2>

              <div className="space-y-4">
                {[
                  { name: 'Anthropic API', connected: true, icon: Zap },
                  { name: 'Google Maps API', connected: true, icon: Globe },
                  { name: 'Firecrawl API', connected: true, icon: Globe },
                  { name: 'Perplexity API', connected: true, icon: Globe },
                  { name: 'Resend Email', connected: true, icon: Mail },
                  { name: 'Hunter.io', connected: false, icon: User },
                ].map((integration) => (
                  <div
                    key={integration.name}
                    className="flex items-center justify-between p-4 bg-surface-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white">
                        <integration.icon className="w-5 h-5 text-surface-600" />
                      </div>
                      <div>
                        <p className="font-medium text-surface-900">
                          {integration.name}
                        </p>
                        <p className="text-sm text-surface-500">
                          {integration.connected ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    <button
                      className={clsx(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        integration.connected
                          ? 'bg-green-100 text-green-700'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      )}
                    >
                      {integration.connected ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">
                Notification Preferences
              </h2>

              <div className="space-y-4">
                {[
                  {
                    label: 'Email responses',
                    description: 'Get notified when someone replies to your emails',
                    enabled: true,
                  },
                  {
                    label: 'Campaign completion',
                    description: 'Get notified when a campaign finishes',
                    enabled: true,
                  },
                  {
                    label: 'Daily summary',
                    description: 'Receive a daily digest of your campaign performance',
                    enabled: false,
                  },
                  {
                    label: 'Bounce alerts',
                    description: 'Get notified when emails bounce',
                    enabled: true,
                  },
                ].map((notification) => (
                  <div
                    key={notification.label}
                    className="flex items-center justify-between p-4 bg-surface-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-surface-900">
                        {notification.label}
                      </p>
                      <p className="text-sm text-surface-500">
                        {notification.description}
                      </p>
                    </div>
                    <button
                      className={clsx(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        notification.enabled ? 'bg-primary-600' : 'bg-surface-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          notification.enabled ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">
                Billing & Subscription
              </h2>

              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-primary-900">Pro Plan</p>
                    <p className="text-sm text-primary-700">
                      $99/month • Unlimited campaigns
                    </p>
                  </div>
                  <span className="badge-primary">Active</span>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-surface-900 mb-3">
                  Usage This Month
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-surface-600">Emails Sent</span>
                      <span className="font-medium">3,420 / 10,000</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: '34.2%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-surface-600">API Calls</span>
                      <span className="font-medium">1,250 / 5,000</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full"
                        style={{ width: '25%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-200">
                <button className="btn-secondary">Manage Subscription</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

