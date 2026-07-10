export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
          YouChat Technologies
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Africa's Next-Gen Social Media & Creator Monetization Platform
        </p>

        {/* Services */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-2xl mb-3">✓ Verification Badges</h3>
            <p className="text-gray-400">Get verified and stand out</p>
            <p className="text-cyan-400 font-bold mt-2">₦1,000/month</p>
          </div>

          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-2xl mb-3">💰 Creator Payments</h3>
            <p className="text-gray-400">Earn from your content</p>
            <p className="text-green-400 font-bold mt-2">Pay per view</p>
          </div>

          <div className="bg-[111] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-2xl mb-3"> Social Platform</h3>
            <p className="text-gray-400">Connect with African creators</p>
            <p className="text-purple-400 font-bold mt-2">Free to join</p>
          </div>
        </div>

        {/* Contact */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <p className="text-gray-400">Contact: wallejegeson@gmail.com</p>
          <p className="text-gray-500 text-sm mt-2">
            Launching Soon - Join the Waitlist
          </p>
        </div>
      </div>
    </div>
  );
}
