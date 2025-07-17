import React, { useState } from "react";
import Plot from "react-plotly.js";
import { strikeDipRakeToMomentTensor } from "../data/tensors";

export default function SeismicPlot() {
  const [inputs, setInputs] = useState({
    strike: 30,
    dip: 45,
    rake: 60,
    magnitude: 6,
    azimuth: 45,
  });

  const [waveforms, setWaveforms] = useState({ Z: [], R: [], T: [] });
  // const [azimuth, setAzimuth] = useState(60);

  const handleChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: parseFloat(e.target.value) });
  };

  const generateWaveforms = async () => {
    const { strike, dip, rake, magnitude, azimuth } = inputs;
    const mt = strikeDipRakeToMomentTensor(strike, dip, rake, magnitude);
    console.log(mt);

    const az = (azimuth * Math.PI) / 180;

    const output = { Z: [], R: [], T: [] };
    const channelMap = {
      Z: ["ZSS", "ZDD", "ZEP", "ZDS"],
      R: ["RSS", "RDD", "REP", "RDS"],
      T: ["TSS", "TDS"],
    };

    const greensData = {};

    // Preload all required Green’s functions
    for (const channels of Object.values(channelMap)) {
      for (const ch of channels) {
        if (!greensData[ch]) {
          try {
            const res = await fetch(`/greens/${ch}.json`);
            const json = await res.json();
            greensData[ch] = json.data;
          } catch (err) {
            console.warn(`Missing Green's function: ${ch}`);
            greensData[ch] = Array(15520).fill(0);
          }
        }
      }
    }

    // Vertical (Z)
    {
      const { Mrr, Mtt, Mpp, Mrp, Mtp, Mrt } = mt;
      const Z = greensData["ZSS"].map(
        (_, i) =>
          Mtt *
            ((greensData["ZSS"][i] / 2) * Math.cos(2 * az) -
              greensData["ZDD"][i] / 6 +
              greensData["ZEP"][i] / 3) +
          Mpp *
            ((-greensData["ZSS"][i] / 2) * Math.cos(2 * az) -
              greensData["ZDD"][i] / 6 +
              greensData["ZEP"][i] / 3) +
          Mrr * (greensData["ZDD"][i] / 3 + greensData["ZEP"][i] / 3) +
          Mtp * (greensData["ZSS"][i] * Math.sin(2 * az)) +
          Mrt * (greensData["ZDS"][i] * Math.cos(az)) +
          Mrp * (greensData["ZDS"][i] * Math.sin(az))
      );
      output.Z = Z.slice(0, 4000);
    }

    // Radial (R)
    {
      const { Mrr, Mtt, Mpp, Mrp, Mtp, Mrt } = mt;
      const R = greensData["RSS"].map(
        (_, i) =>
          Mtt *
            ((greensData["RSS"][i] / 2) * Math.cos(2 * az) -
              greensData["RDD"][i] / 6 +
              greensData["REP"][i] / 3) +
          Mpp *
            ((-greensData["RSS"][i] / 2) * Math.cos(2 * az) -
              greensData["RDD"][i] / 6 +
              greensData["REP"][i] / 3) +
          Mrr * (greensData["RDD"][i] / 3 + greensData["REP"][i] / 3) +
          Mtp * (greensData["RSS"][i] * Math.sin(2 * az)) +
          Mrt * (greensData["RDS"][i] * Math.cos(az)) +
          Mrp * (greensData["RDS"][i] * Math.sin(az))
      );
      output.R = R.slice(0, 4000);
    }

    // Transverse (T)
    {
      const { Mtt, Mpp, Mtp, Mrt, Mrp } = mt;
      const T = greensData["TSS"].map(
        (_, i) =>
          Mtt * ((greensData["TSS"][i] / 2) * Math.sin(2 * az)) -
          Mpp * ((greensData["TSS"][i] / 2) * Math.sin(2 * az)) -
          Mtp * (greensData["TSS"][i] * Math.cos(2 * az)) +
          Mrt * (greensData["TDS"][i] * Math.sin(az)) -
          Mrp * (greensData["TDS"][i] * Math.cos(az))
      );
      output.T = T.slice(0, 4000);
    }

    setWaveforms(output);
  };

  const time = Array.from({ length: 4000 }, (_, i) => i / 4);

  const downloadWaveforms = () => {
    const data = waveforms.Z.map((_, i) => ({
      time: time[i],
      Z: waveforms.Z[i],
      R: waveforms.R[i],
      T: waveforms.T[i],
    }));

    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["time,Z,R,T", ...data.map((d) => `${d.time},${d.Z},${d.R},${d.T}`)].join(
        "\n"
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "waveforms.csv");
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className=" w-screen bg-gradient-to-br from-blue-50 via-white to-gray-100 text-gray-800 flex">
      {/* Sidebar */}
      <div className="w-1/5 p-6 bg-white/80 backdrop-blur-md shadow-md border-r border-gray-200 flex flex-col ">
        <div>
          <h2 className="text-2xl font-bold mb-6 text-blue-700">
            Seismic Simulator
          </h2>

          <div className="mb-6 text-sm space-y-1">
            <p>
              <span className="font-semibold">Velocity Model:</span> ak135_2s
            </p>
            <p>
              <span className="font-semibold">Source Distance:</span> 600 km
            </p>
            <p>
              <span className="font-semibold">Source Depth:</span> 10 km
            </p>
          </div>

          {/* Styled Input Fields */}
          <div className="space-y-2 text-sm">
            {["strike", "dip", "rake", "magnitude", "azimuth"].map((param) => (
              <div
                key={param}
                className="bg-white rounded-xl p-3 shadow-inner border border-gray-200"
              >
                <label className="block text-gray-600 font-medium mb-1 capitalize">
                  {param} {param === "magnitude" ? "(Mw)" : "(°)"}
                </label>
                <input
                  type="number"
                  name={param}
                  value={inputs[param]}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                  placeholder={`Enter ${param}`}
                />
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={downloadWaveforms}
          className="mt-4 bg-green-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-green-700 transition"
        >
          Download Waveforms
        </button>

        <button
          onClick={generateWaveforms}
          className="mt-12 bg-blue-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Generate Waveforms
        </button>
      </div>

      {/* Plot Area */}
      <div className="ml-10 ">
        <Plot
          data={[
            // Z (Vertical)
            {
              x: time,
              y: waveforms.Z,
              type: "scatter",
              mode: "lines",
              name: "Vertical (Z)",
              line: { color: "black", width: 2 },
              yaxis: "y",
            },
            // R (Radial)
            {
              x: time,
              y: waveforms.R,
              type: "scatter",
              mode: "lines",
              name: "Radial (R)",
              line: { color: "black", width: 2 },
              yaxis: "y2",
            },
            // T (Transverse)
            {
              x: time,
              y: waveforms.T,
              type: "scatter",
              mode: "lines",
              name: "Transverse (T)",
              line: { color: "black", width: 2 },
              yaxis: "y3",
            },
          ]}
          layout={{
            width: 1100,
            height: 700,
            margin: { l: 80, r: 60, t: 30, b: 70 },
            showlegend: false,

            xaxis: {
              domain: [0, 1],
              title: { text: "Time (s)", font: { size: 16 } },
              anchor: "y3",
              tickfont: { size: 13 },
              tick0: 0,
              dtick: 100,
              range: [0, 1000],
            },

            yaxis: {
              domain: [0.7, 1.0],
              title: { text: "Amplitude", font: { size: 16 } },
              tickfont: { size: 13 },
            },
            yaxis2: {
              domain: [0.35, 0.65],
              title: { text: "Amplitude", font: { size: 16 } },
              tickfont: { size: 13 },
            },
            yaxis3: {
              domain: [0.0, 0.3],
              title: { text: "Amplitude", font: { size: 16 } },
              tickfont: { size: 13 },
            },

            annotations: [
              {
                text: "Vertical (Z)",
                xref: "paper",
                yref: "paper",
                x: 1.0,
                y: 0.97,
                showarrow: false,
                font: { size: 15 },
              },
              {
                text: "Radial (R)",
                xref: "paper",
                yref: "paper",
                x: 1.0,
                y: 0.6,
                showarrow: false,
                font: { size: 15 },
              },
              {
                text: "Transverse (T)",
                xref: "paper",
                yref: "paper",
                x: 1.0,
                y: 0.24,
                showarrow: false,
                font: { size: 15 },
              },
            ],
          }}
          config={{ responsive: true }}
        />
      </div>
    </div>
  );
}
