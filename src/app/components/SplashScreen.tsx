import { motion } from 'motion/react';
import logo from '../../imports/ChatGPT_Image_19_abr_2026,_03_43_27_p.m..png';
import { getCurrentCompany } from '../lib/supabase';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const company = getCurrentCompany();
  const companyName = company === 'celumundo' ? 'Celumundo VIP' : 'Repuesto VIP';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onAnimationComplete={() => {
        setTimeout(onComplete, 5000);
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Logo dentro de card circular con borde verde */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
          }}
          transition={{
            duration: 1,
            ease: "backOut",
          }}
          className="relative"
        >
          {/* Card circular con borde verde */}
          <motion.div
            className="relative w-64 h-64 rounded-full border-8 border-green-600 bg-white shadow-2xl flex items-center justify-center overflow-hidden"
            animate={{
              boxShadow: [
                "0 20px 60px rgba(22, 163, 74, 0.3)",
                "0 20px 80px rgba(22, 163, 74, 0.5)",
                "0 20px 60px rgba(22, 163, 74, 0.3)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <img
              src={logo}
              alt="Logo"
              className="w-56 h-56 object-contain"
            />
          </motion.div>

          {/* Anillo decorativo */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-green-400"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 1.3],
              opacity: [0.6, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        </motion.div>

        {/* Texto de bienvenida */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          <motion.h1
            className="text-3xl text-black mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            ¡Bienvenido a
          </motion.h1>

          <motion.h2
            className="text-5xl font-bold text-green-600"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              delay: 2,
              duration: 0.8,
              ease: "backOut",
            }}
          >
            {companyName}!
          </motion.h2>

          {/* Línea decorativa minimalista */}
          <motion.div
            className="mt-8 mx-auto h-0.5 bg-green-600"
            initial={{ width: 0 }}
            animate={{ width: "240px" }}
            transition={{ delay: 2.5, duration: 1 }}
          />
        </motion.div>

        {/* Barra de progreso minimalista */}
        <motion.div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-80 h-1 bg-gray-200 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
        >
          <motion.div
            className="h-full bg-green-600"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 3, duration: 2, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
