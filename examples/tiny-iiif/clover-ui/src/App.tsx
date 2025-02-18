import Viewer from '@samvera/clover-iiif/viewer';
import './App.css';


function App() {
  return (
    <>
      <div>
        <Viewer 
          iiifContent="http://localhost:3000/sample/manifest.json"
          options={{
            canvasHeight: "auto"
          }}
        />
      </div>
    </>
  )
}

export default App
