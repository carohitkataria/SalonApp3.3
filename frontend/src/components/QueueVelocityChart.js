import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Users } from 'lucide-react';

export default function QueueVelocityChart({ token, salon }) {
  const [velocityData, setVelocityData] = useState([]);
  const [avgWaitTime, setAvgWaitTime] = useState(0);

  useEffect(() => {
    calculateVelocity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const calculateVelocity = () => {
    // Generate mock velocity data based on token position
    // In real implementation, this would come from historical data
    const currentPosition = token.queue_position || 0;
    const tokenNumber = parseInt(token.token_number.replace(/\D/g, '')) || 1;
    
    // Simulate queue progression
    const dataPoints = [];
    const totalTokens = tokenNumber;
    const estimatedMinutesPerToken = 15;
    
    for (let i = 0; i <= 10; i++) {
      const progress = (i / 10) * 100;
      const tokensServed = Math.floor((totalTokens - currentPosition) * (i / 10));
      const timeElapsed = tokensServed * estimatedMinutesPerToken;
      
      dataPoints.push({
        time: `${Math.floor(timeElapsed / 60)}h ${timeElapsed % 60}m`,
        tokensServed,
        progress
      });
    }
    
    setVelocityData(dataPoints);
    setAvgWaitTime(estimatedMinutesPerToken);
  };

  const getVelocityColor = (avgTime) => {
    if (avgTime <= 10) return 'text-green-500';
    if (avgTime <= 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getVelocityLabel = (avgTime) => {
    if (avgTime <= 10) return 'Fast';
    if (avgTime <= 20) return 'Moderate';
    return 'Slow';
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Queue Velocity
        </h3>
        <div className={`flex items-center gap-2 ${getVelocityColor(avgWaitTime)} font-semibold`}>
          <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
          {getVelocityLabel(avgWaitTime)}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
          <p className="text-xs text-gray-600 dark:text-gray-400">Avg Wait</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{avgWaitTime}m</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
          <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
          <p className="text-xs text-gray-600 dark:text-gray-400">In Queue</p>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{token.queue_position || 0}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
          <p className="text-xs text-gray-600 dark:text-gray-400">Est. Wait</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {Math.max((token.queue_position || 0) * avgWaitTime, 5)}m
          </p>
        </div>
      </div>

      {/* Visual Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Queue Progress</span>
          <span>Est. Completion: {velocityData[velocityData.length - 1]?.time || '0h 0m'}</span>
        </div>
        
        {/* Progress Bars */}
        <div className="space-y-3">
          {velocityData.filter((_, i) => i % 2 === 0).map((point, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">{point.time}</span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${point.progress}%` }}
                >
                  {point.progress > 20 && (
                    <span className="text-xs font-semibold text-white">{point.tokensServed}</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(point.progress)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insight */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
          <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            The salon is processing approximately <strong>1 customer every {avgWaitTime} minutes</strong>. 
            Your estimated wait time is <strong>{Math.max((token.queue_position || 0) * avgWaitTime, 5)} minutes</strong>.
          </span>
        </p>
      </div>
    </div>
  );
}
